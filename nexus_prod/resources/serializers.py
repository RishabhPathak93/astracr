"""resources/serializers.py"""
from rest_framework import serializers
from .models import ResourceProfile, TimeEntry
from accounts.serializers import UserSerializer


class ResourceProfileSerializer(serializers.ModelSerializer):
    user_detail          = UserSerializer(source='user', read_only=True)
    total_hours_logged   = serializers.ReadOnlyField()
    active_project_count = serializers.SerializerMethodField()

    class Meta:
        model  = ResourceProfile
        fields = [
            'id', 'user', 'user_detail', 'job_title', 'skills',
            'hourly_rate', 'availability', 'total_hours_logged',
            'active_project_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_active_project_count(self, obj):
        return obj.user.assigned_projects.filter(
            status__in=['planning', 'in_progress', 'review', 'on_hold']
        ).count()


class TimeEntrySerializer(serializers.ModelSerializer):
    resource_name = serializers.CharField(source='resource.user.name', read_only=True)
    project_name  = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = TimeEntry
        fields = [
            'id', 'resource', 'resource_name', 'project', 'project_name',
            'date', 'hours', 'description', 'approved', 'approved_by',
            'approved_at', 'created_at',
        ]
        read_only_fields = ['id', 'approved', 'approved_by', 'approved_at', 'created_at']

    def validate_hours(self, value):
        if value < 0.25:
            raise serializers.ValidationError('Minimum entry is 0.25 hours (15 minutes).')
        if value > 24:
            raise serializers.ValidationError('Cannot log more than 24 hours in a single entry.')
        return value