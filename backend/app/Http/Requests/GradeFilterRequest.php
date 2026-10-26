<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'period' => ['nullable', 'string', 'max:60'],
            'student_id' => ['nullable', 'integer', 'exists:students,id'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
