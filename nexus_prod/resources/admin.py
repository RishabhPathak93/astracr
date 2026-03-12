"""resources/admin.py"""
from django.contrib import admin
from .models import ResourceProfile, TimeEntry


@admin.register(ResourceProfile)
class ResourceProfileAdmin(admin.ModelAdmin):
    list_display  = ['user', 'job_title', 'hourly_rate', 'availability', 'total_hours_logged']
    search_fields = ['user__name', 'job_title']
    readonly_fields = ['created_at', 'updated_at', 'total_hours_logged']


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display  = ['resource', 'project', 'date', 'hours', 'approved', 'approved_by']
    list_filter   = ['approved', 'date']
    readonly_fields = ['approved_at', 'created_at']
