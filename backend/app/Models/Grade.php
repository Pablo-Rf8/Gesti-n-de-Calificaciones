<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Grade extends Model
{
    public const PERIODS = ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];

    public const PASSING_SCORE = 60;

    protected $fillable = ['student_id', 'subject', 'academic_year', 'period', 'score'];

    protected function casts(): array
    {
        return ['score' => 'decimal:2', 'academic_year' => 'integer'];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
