<?php

namespace App\Http\Controllers;

use App\Http\Requests\GradeFilterRequest;
use App\Http\Requests\GradeRequest;
use App\Models\Grade;
use App\Queries\GradeQuery;
use App\Services\GradeWorkbook;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
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

    public function export(GradeFilterRequest $request, GradeQuery $query, GradeWorkbook $workbook): StreamedResponse
    {
        $grades = $query->filtered($request->validated());

        return response()->streamDownload(fn () => $workbook->write($grades), 'calificaciones-'.now()->format('Y-m-d').'.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
