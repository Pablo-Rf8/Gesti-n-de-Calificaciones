<?php

namespace App\Queries;

use App\Models\Grade;
use Illuminate\Database\Eloquent\Builder;

class GradeQuery
{
    public function filtered(array $filters): Builder
    {
        return Grade::query()->with('student')
            ->when(filled($filters['q'] ?? null), fn (Builder $query) => $query->whereHas('student', fn (Builder $students) => $students->search($filters['q'])))
            ->when($filters['section'] ?? null, fn (Builder $query, string $section) => $query->whereHas('student', fn (Builder $students) => $students->where('section', $section)))
            ->when($filters['subject'] ?? null, fn (Builder $query, string $value) => $query->where('subject', 'like', '%'.$value.'%'))
            ->when($filters['period'] ?? null, fn (Builder $query, string $value) => $query->where('period', $value))
            ->when($filters['academic_year'] ?? null, fn (Builder $query, int $value) => $query->where('academic_year', $value))
            ->when($filters['student_id'] ?? null, fn (Builder $query, int $id) => $query->where('student_id', $id))
            ->orderByDesc('id');
    }
}
