"""timelines/models.py"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from accounts.models import User
from projects.models import Project


class Timeline(models.Model):
    class Status(models.TextChoices):
        PENDING     = 'pending',     'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED   = 'completed',   'Completed'
        ON_HOLD     = 'on_hold',     'On Hold'

    project     = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='timelines')
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_date  = models.DateField()
    end_date    = models.DateField()
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    progress    = models.PositiveSmallIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    color       = models.CharField(max_length=10, default='#6366f1')
    order       = models.PositiveIntegerField(default=0)
    assignees   = models.ManyToManyField(User, related_name='timeline_assignments', blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'start_date']
        indexes  = [models.Index(fields=['project', 'status'])]

    def __str__(self):
        return f'{self.project.name} / {self.name}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({'end_date': 'End date must be after start date.'})

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days if self.start_date and self.end_date else 0


class TimelineMilestone(models.Model):
    timeline     = models.ForeignKey(Timeline, on_delete=models.CASCADE, related_name='milestones')
    title        = models.CharField(max_length=200)
    due_date     = models.DateField()
    completed    = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return self.title
