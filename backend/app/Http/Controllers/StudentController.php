<?php

namespace App\Http\Controllers;

use App\Http\Requests\StudentRequest;
use App\Models\Student;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:150'], 'section' => ['nullable', Rule::in(['A', 'B'])], 'page' => ['sometimes', 'integer', 'min:1']]);
        $students = Student::query()->withCount('grades')
            ->when(filled($filters['q'] ?? null), fn ($query) => $query->search($filters['q']))
            ->when($filters['section'] ?? null, fn ($query, string $section) => $query->where('section', $section))
            ->orderByDesc('id')->paginate(10)->withQueryString();

        return response()->json($students);
    }

    public function store(StudentRequest $request): JsonResponse
    {
        return response()->json(['data' => Student::create($request->validated())], 201);
    }

    public function show(Student $student): JsonResponse
    {
        return response()->json(['data' => $student->loadCount('grades')]);
    }

    public function update(StudentRequest $request, Student $student): JsonResponse
    {
        $student->update($request->validated());

        return response()->json(['data' => $student->fresh()]);
    }

    public function destroy(Student $student): Response|JsonResponse
    {
        if ($student->grades()->exists()) {
            return response()->json(['message' => 'El alumno tiene calificaciones. Eliminá primero sus notas para conservar el control de los registros.'], 409);
        }
        try {
            $student->delete();
        } catch (QueryException $exception) {
            if (str_starts_with((string) $exception->getCode(), '23')) {
                return response()->json(['message' => 'El alumno tiene calificaciones y no se puede eliminar.'], 409);
            }
            throw $exception;
        }

        return response()->noContent();
    }
}
