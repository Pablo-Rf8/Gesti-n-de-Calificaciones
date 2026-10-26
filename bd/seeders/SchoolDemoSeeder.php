<?php

namespace Database\Seeders;

use App\Models\Grade;
use App\Models\Student;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SchoolDemoSeeder extends Seeder
{
    public function run(): void
    {
        $names = ['Ana Lucía Pérez', 'Carlos Daniel López', 'María José García', 'Diego Alejandro Morales', 'Valeria Sofía Hernández', 'Luis Fernando Ramírez', 'Camila Isabel Castillo', 'José Andrés Méndez', 'Sofía Gabriela Ruiz', 'Mateo Santiago Flores'];
        $scores = [[85, 90, 88, 92], [55, 60, 58, 62], [60, 60, 60, 60], [92, 95, 91, 94], [50, 55, 58, 59], [70, 75, 80, 85], [65, 58, 62, 61], [100, 98, 96, 99], [45, 50, 52, 55], [75, 80, 78, null]];
        DB::transaction(function () use ($names, $scores): void {
            foreach ($names as $index => $name) {
                $student = Student::firstOrNew(['registration_number' => 'DEMO-'.now()->year.'-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)]);
                if (!$student->exists) {
                    $student->name = $name;
                    $student->section = $index < 5 ? 'A' : 'B';
                    $student->is_demo = true;
                    $student->save();
                }
                if (!$student->is_demo) {
                    continue;
                }
                foreach (['Matemática', 'Comunicación y Lenguaje'] as $subjectIndex => $subject) {
                    foreach (Grade::PERIODS as $termIndex => $period) {
                        $score = $scores[$index][$termIndex];
                        if ($score === null && $subjectIndex === 0) {
                            continue;
                        }
                        Grade::firstOrCreate([
                            'student_id' => $student->id, 'subject' => $subject,
                            'academic_year' => now()->year, 'period' => $period,
                        ], ['score' => $score === null ? 80 : min(100, $score + $subjectIndex * 5)]);
                    }
                }
            }
        });
    }
}
