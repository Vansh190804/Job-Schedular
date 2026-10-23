from rest_framework import serializers
from .models import Job, JobRun
from datetime import timedelta
from django.utils import timezone


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "id",
            "name",
            "task_type",
            "schedule_type",
            "run_at",
            "interval_seconds",
            "next_run_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "next_run_at"]

    def validate(self, attrs):
        schedule_type = attrs.get(
            "schedule_type",
            getattr(self.instance, "schedule_type", None),
        )

        run_at = attrs.get(
            "run_at",
            getattr(self.instance, "run_at", None),
        )

        interval_seconds = attrs.get(
            "interval_seconds",
            getattr(self.instance, "interval_seconds", None),
        )

        if schedule_type == Job.ScheduleType.ONE_TIME:
            if run_at is None:
                raise serializers.ValidationError({
                    "run_at": "A one-time job requires a run date and time."
                })

            if interval_seconds is not None:
                raise serializers.ValidationError({
                    "interval_seconds": "One-time jobs cannot have an interval."
                })

        elif schedule_type == Job.ScheduleType.INTERVAL:
            if interval_seconds is None or interval_seconds <= 0:
                raise serializers.ValidationError({
                    "interval_seconds": "Provide an interval greater than zero."
                })

            if run_at is not None:
                raise serializers.ValidationError({
                    "run_at": "Interval jobs cannot specify a one-time run date."
                })

        return attrs

    def create(self, validated_data):
        if validated_data["schedule_type"] == Job.ScheduleType.ONE_TIME:
            validated_data["next_run_at"] = validated_data["run_at"]
        else:
            validated_data["next_run_at"] = (
                timezone.now() + timedelta(seconds=validated_data["interval_seconds"])
            )

        return super().create(validated_data)

    def update(self, instance, validated_data):
        schedule_changed = any(
            field in validated_data for field in ("schedule_type", "run_at", "interval_seconds")
        )

        if schedule_changed:
            schedule_type = validated_data.get("schedule_type", instance.schedule_type)

            if schedule_type == "one_time":
                validated_data["next_run_at"] = validated_data.get(
                    "run_at", instance.run_at
                )
            else:
                interval = validated_data.get(
                    "interval_seconds", instance.interval_seconds
                )

                validated_data["next_run_at"] = (timezone.now() + timedelta(seconds=interval))

        return super().update(instance, validated_data)

    


class JobRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRun
        fields = [
            "id",
            "job",
            "scheduled_at",
            "started_at",
            "finished_at",
            "status",
            "error_message",
            "celery_task_id",
            "attempt",
            "created_at",
        ]

        read_only_fields= fields

        

