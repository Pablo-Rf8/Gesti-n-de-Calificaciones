<?php

namespace App\Http\Requests;

use App\Models\Grade;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GradeRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->isMethod('post') && ! $this->has('academic_year')) {
            $this->merge(['academic_year' => now()->year]);
        }
    }

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
            'academic_year' => [$presence, 'required', 'integer', 'between:2000,2100'],
            'period' => [$presence, 'required', Rule::in(Grade::PERIODS),
                Rule::unique('grades')->where('student_id', $this->input('student_id', $grade?->student_id))
                    ->where('academic_year', $this->input('academic_year', $grade?->academic_year))
                    ->where('subject', $this->input('subject', $grade?->subject))->ignore($grade),
            ],
            'score' => [$presence, 'required', 'numeric', 'between:0,100', 'decimal:0,2'],
        ];
    }

    public function messages(): array
    {
        return [
            'period.unique' => 'Este alumno ya tiene una nota para esa asignatura, ciclo y bimestre. Editá la nota existente.',
            'period.in' => 'Seleccioná un bimestre del 1 al 4.',
        ];
    }
}
