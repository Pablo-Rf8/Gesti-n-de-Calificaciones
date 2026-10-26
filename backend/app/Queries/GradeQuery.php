<?php

namespace App\Queries;

use App\Models\Grade;
use Illuminate\Database\Eloquent\Builder;

class GradeQuery
{
    public function filtered(array $filters): Builder
    {
        return Grade::query()->with('student')
            ->when($filters['q'] ?? null, fn (Builder $query, string $term) => $query->whereHas('student', function (Builder $students) use ($term): void {
                $students->where('name', 'like', '%'.$term.'%')->orWhere('registration_number', 'like', '%'.$term.'%');
            }))
            ->when($filters['subject'] ?? null, fn (Builder $query, string $value) => $query->where('subject', 'like', '%'.$value.'%'))
            ->when($filters['period'] ?? null, fn (Builder $query, string $value) => $query->where('period', 'like', '%'.$value.'%'))
            ->when($filters['student_id'] ?? null, fn (Builder $query, int $id) => $query->where('student_id', $id))
            ->orderByDesc('id');
    }
}
