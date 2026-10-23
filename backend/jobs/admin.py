from django.contrib import admin
from .models import Job, JobRun, DispatchOutbox

# Register your models here.
admin.site.register(Job)
admin.site.register(JobRun)
admin.site.register(DispatchOutbox)

