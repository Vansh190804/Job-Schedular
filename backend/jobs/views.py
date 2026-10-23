import secrets

from django.shortcuts import get_object_or_404
from .models import Job, JobRun, GoogleAccount

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import JobSerializer, JobRunSerializer
from django.utils import timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.shortcuts import redirect

from jobs.oauth import oauth

# Create your views here.
class JobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobSerializer

    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class JobRunListView(generics.ListAPIView):
     serializer_class = JobRunSerializer

     def get_queryset(self):
        job = get_object_or_404(
            Job,
            id=self.kwargs["job_id"],
            owner=self.request.user
        )

        return JobRun.objects.filter(job=job).order_by("-created_at")


class JobControlView(APIView):
     def post(self, request, job_id, action):
          job = get_object_or_404(Job, id=job_id, owner=request.user)

          if action == "pause":
                if job.cancelled_at is not None:
                    return Response({"detail": "Cannot pause a cancelled job."}, status=status.HTTP_400_BAD_REQUEST)

                job.is_active = False
                job.save(update_fields=["is_active"])

          elif action == "resume":
                if job.cancelled_at is not None:
                    return Response({"detail": "Cannot resume a cancelled job."}, status=status.HTTP_400_BAD_REQUEST)

                job.is_active = True
                job.save(update_fields=["is_active"])

          elif action == "cancel":
                if job.cancelled_at is not None:
                    return Response({"detail": "Job is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)

                job.is_active = False
                job.cancelled_at = timezone.now()
                job.save(update_fields=["is_active", "cancelled_at"])

          else:
               return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

          return Response({
                "id": job.id,
                "name": job.name,
                "is_active": job.is_active,
                "cancelled_at": job.cancelled_at,
          })



def google_login(request):
        if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
            return Response(
               {"detail": "Google OAuth is not configured."},
               status=503,
            )

        redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        return oauth.google.authorize_redirect(request, redirect_uri)



def google_callback(request):
          User = get_user_model()

          try:
               token = oauth.google.authorize_access_token(request)
               info = token["userinfo"]

               google_sub = info.get("sub")
               email = info.get("email")
               email_verified = info.get("email_verified", False)

               if not google_sub or not email or not email_verified:
                 return redirect(
                   f"{settings.FRONTEND_URL}/login?error=google_identity_invalid"
                 )


               with transaction.atomic():
                 account = (
                  GoogleAccount.objects
                  .select_related("user")
                  .filter(google_sub=google_sub)
                  .first()
                 )

                 if account:
                   user = account.user

                   if not user.is_active:
                     return redirect(
                        f"{settings.FRONTEND_URL}/login?error=account_disabled"
                     )

                   account.email = email
                   account.save(update_fields=["email"])

                 else:
                  if User.objects.filter(email__iexact=email).exists():
                    return redirect(
                        f"{settings.FRONTEND_URL}/login?error=account_exists"
                    )

                  base = email.split("@")[0][:150] or "google_user"
                  username = base
                  suffix = 1

                  while User.objects.filter(username=username).exists():
                    ending = f"_{suffix}"
                    username = f"{base[:150 - len(ending)]}{ending}"
                    suffix += 1

                  user = User.objects.create_user(
                    username=username,
                    email=email,
                  )
                  user.set_unusable_password()
                  user.save(update_fields=["password"])

                  GoogleAccount.objects.create(
                    user=user,
                    google_sub=google_sub,
                    email=email,
                  )

               code = secrets.token_urlsafe(32)
               cache.set(f"google-login:{code}", user.pk, timeout=60)

               return redirect(
                  f"{settings.FRONTEND_URL}/oauth/callback?code={code}"
               )

          except Exception:
             return redirect(
                f"{settings.FRONTEND_URL}/login?error=google_login_failed"
            )



class GoogleTokenExchangeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        code = request.data.get("code")

        if not code:
            return Response(
                {"detail": "Code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"google-login:{code}"
        user_id = cache.get(cache_key)

        if user_id is None:
            return Response(
                {"detail": "Code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(cache_key)

        User = get_user_model()

        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found or disabled."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.pk,
                "username": user.get_username(),
                "email": user.email,
            },
        })


          
     