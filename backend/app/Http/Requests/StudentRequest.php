<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StudentRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->isMethod('post') && ! $this->has('section')) {
            $this->merge(['section' => 'A']);
        }
    }

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'registration_number' => ['required', 'string', 'max:40', Rule::unique('students')->ignore($this->route('student'))],
            'section' => ['sometimes', 'required', Rule::in(['A', 'B'])],
        ];
    }
}
