<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GradeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $presence = $this->isMethod('patch') ? 'sometimes' : 'required';
        $grade = $this->route('grade');

        return [
            'student_id' => [$presence, 'required', 'integer', 'exists:students,id'],
            'subject' => [$presence, 'required', 'string', 'max:100'],
            'period' => [$presence, 'required', 'string', 'max:60',
                Rule::unique('grades')->where('student_id', $this->input('student_id', $grade?->student_id))
                    ->where('subject', $this->input('subject', $grade?->subject))->ignore($grade),
            ],
            'score' => [$presence, 'required', 'numeric', 'between:0,100', 'decimal:0,2'],
        ];
    }

    public function messages(): array
    {
        return ['period.unique' => 'Este alumno ya tiene una nota en esa asignatura y período. Editá la nota existente.'];
    }
}
