<?php

namespace App\Queries;

use App\Models\Grade;
use Illuminate\Database\Eloquent\Builder;

class AnnualGradeQuery
{
    public function __construct(private GradeQuery $grades) {}

    public function filtered(array $filters): Builder
    {
        unset($filters['period']);
        $query = $this->grades->filtered($filters)->reorder()
            ->whereIn('period', Grade::PERIODS)
            ->select(['student_id', 'subject', 'academic_year'])
            ->selectRaw('COUNT(DISTINCT period) AS completed_terms, ROUND(SUM(score) * 100) AS total_hundredths')
            ->groupBy('student_id', 'subject', 'academic_year')
            ->orderBy('student_id')->orderBy('subject')->orderByDesc('academic_year');
        foreach (Grade::PERIODS as $index => $period) {
            $query->selectRaw('MAX(CASE WHEN period = ? THEN score END) AS term_'.($index + 1), [$period]);
        }

        return $query;
    }

    public function result(Grade $row): array
    {
        $complete = (int) $row->completed_terms === 4;
        $total = (int) $row->total_hundredths;

        return [
            'student_id' => $row->student_id,
            'student' => $row->student,
            'subject' => $row->subject,
            'academic_year' => $row->academic_year,
            'terms' => array_map(fn (int $number) => $row->{'term_'.$number} === null ? null : (float) $row->{'term_'.$number}, range(1, 4)),
            'completed_terms' => (int) $row->completed_terms,
            'average' => $complete ? $total / 400 : null,
            'status' => ! $complete ? 'Pendiente' : ($total >= Grade::PASSING_SCORE * 400 ? 'Aprobado' : 'Reprobado'),
        ];
    }
}
