"""resources/models.py"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from accounts.models import User
from projects.models import Project


class ResourceProfile(models.Model):
    user         = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='resource_profile',
        limit_choices_to={'role': 'resource'},
    )
    job_title    = models.CharField(max_length=150, blank=True)
    skills       = models.JSONField(default=list, blank=True)
    hourly_rate  = models.DecimalField(max_digits=8, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    availability = models.PositiveSmallIntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__name']

    def __str__(self):
        return f'{self.user.name} — {self.job_title}'

    @property
    def total_hours_logged(self):
        from django.db.models import Sum
        result = self.timeentries.aggregate(total=Sum('hours'))
        return float(result['total'] or 0)


class TimeEntry(models.Model):
    resource    = models.ForeignKey(ResourceProfile, on_delete=models.CASCADE, related_name='timeentries')
    project     = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='timeentries')
    date        = models.DateField()
    hours       = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0.25)])
    description = models.TextField(blank=True)
    approved    = models.BooleanField(default=False, db_index=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_entries',
        limit_choices_to={'role__in': ['admin', 'manager']},
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ['-date']
        constraints  = [
            models.CheckConstraint(check=models.Q(hours__gte=0.25), name='min_hours_quarter')
        ]

    def __str__(self):
        return f'{self.resource.user.name} | {self.project.name} | {self.date} | {self.hours}h'
