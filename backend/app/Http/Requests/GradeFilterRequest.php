<?php

namespace App\Http\Requests;

use App\Models\Grade;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GradeFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:150'],
            'subject' => ['nullable', 'string', 'max:100'],
            'period' => ['nullable', Rule::in(Grade::PERIODS)],
            'academic_year' => ['nullable', 'integer', 'between:2000,2100'],
            'view' => ['nullable', Rule::in(['grades', 'annual'])],
            'student_id' => ['nullable', 'integer', 'exists:students,id'],
            'section' => ['nullable', Rule::in(['A', 'B'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
