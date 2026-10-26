<?php

return [
    'required' => 'El campo :attribute es obligatorio.',
    'email' => 'Ingresá un correo electrónico válido.',
    'string' => 'El campo :attribute debe ser texto.',
    'integer' => 'El campo :attribute debe ser un número entero.',
    'numeric' => 'El campo :attribute debe ser numérico.',
    'decimal' => 'La calificación admite hasta dos decimales.',
    'exists' => 'El valor seleccionado de :attribute no existe.',
    'unique' => 'El valor de :attribute ya está registrado.',
    'max' => ['string' => 'El campo :attribute admite hasta :max caracteres.'],
    'min' => ['numeric' => 'El campo :attribute debe ser al menos :min.'],
    'between' => ['numeric' => 'El campo :attribute debe estar entre :min y :max.'],
    'attributes' => [
        'name' => 'nombre', 'registration_number' => 'matrícula', 'student_id' => 'alumno',
        'subject' => 'asignatura', 'period' => 'período', 'score' => 'calificación',
        'email' => 'correo', 'password' => 'contraseña', 'q' => 'búsqueda', 'page' => 'página',
    ],
];
