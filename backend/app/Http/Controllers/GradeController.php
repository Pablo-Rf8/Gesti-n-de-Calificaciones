<?php

namespace App\Http\Controllers;

use App\Http\Requests\GradeFilterRequest;
use App\Http\Requests\GradeRequest;
use App\Models\Grade;
use App\Models\Student;
use App\Queries\AnnualGradeQuery;
use App\Queries\GradeQuery;
use App\Services\AnnualGradeWorkbook;
use App\Services\GradeWorkbook;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GradeController extends Controller
{
    public function index(GradeFilterRequest $request, GradeQuery $query): JsonResponse
    {
        return response()->json($query->filtered($request->validated())->paginate(10)->withQueryString());
    }

    public function show(Grade $grade): JsonResponse
    {
        return response()->json(['data' => $grade->load('student')]);
    }

    public function summary(GradeFilterRequest $request, AnnualGradeQuery $query): JsonResponse
    {
        $rows = $query->filtered($request->validated())->paginate(10)->withQueryString();

        return response()->json($rows->through(fn (Grade $row) => $query->result($row)));
    }

    public function store(GradeRequest $request): JsonResponse
    {
        try {
            $grade = Grade::create($request->validated());
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['period' => 'Ya existe una nota para este alumno, asignatura y período.']);
        }

        return response()->json(['data' => $grade->load('student')], 201);
    }

    public function update(GradeRequest $request, Grade $grade): JsonResponse
    {
        try {
            $grade->update($request->validated());
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['period' => 'Ya existe una nota para este alumno, asignatura y período.']);
        }

        return response()->json(['data' => $grade->fresh()->load('student')]);
    }

    public function destroy(Grade $grade): Response
    {
        $grade->delete();

        return response()->noContent();
    }

    public function export(GradeFilterRequest $request, GradeQuery $query, GradeWorkbook $workbook, AnnualGradeQuery $annualQuery, AnnualGradeWorkbook $annualWorkbook): StreamedResponse
    {
        $filename = $this->exportFilename($request->validated());
        if ($request->input('view') === 'annual') {
            return response()->streamDownload(fn () => $annualWorkbook->write($annualQuery->filtered($request->validated())), $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]);
        }
        $grades = $query->filtered($request->validated());

        return response()->streamDownload(fn () => $workbook->write($grades), $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function exportFilename(array $filters): string
    {
        $student = null;
        $students = Student::query()->when($filters['section'] ?? null, fn ($query, string $section) => $query->where('section', $section));
        if (! empty($filters['student_id'])) {
            $student = $students->find($filters['student_id']);
        } elseif (filled($filters['q'] ?? null)) {
            $matches = $students->search($filters['q'])->limit(2)->get();
            if ($matches->count() === 1) {
                $student = $matches->first();
            }
        }
        if (! $student) {
            return 'Calificaciones generales'.(! empty($filters['section']) ? ' - Sección '.$filters['section'] : '').'.xlsx';
        }
        $name = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F\x7F]/u', ' ', $student->name);
        $name = trim(Str::limit(Str::squish($name), 100, ''), '. ');

        return 'Calificaciones de '.($name ?: 'Alumno '.$student->id).'.xlsx';
    }
}
