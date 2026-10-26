<?php

namespace Tests\Feature;

use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class SchoolTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        return User::factory()->create();
    }

    private function student(string $registration = '2026-001'): Student
    {
        return Student::create(['name' => 'Alumno de prueba', 'registration_number' => $registration]);
    }

    private function grade(Student $student, array $values = []): Grade
    {
        return Grade::create(array_merge(['student_id' => $student->id, 'subject' => 'Matemática', 'period' => 'Unidad 1', 'score' => 85.5], $values));
    }

    public function test_all_school_routes_require_a_session(): void
    {
        foreach (['/students', '/students/1', '/grades', '/grades/1', '/grades/export/excel', '/auth/me'] as $route) {
            $this->getJson($route)->assertUnauthorized();
        }
        foreach (['/students', '/grades'] as $route) {
            $this->postJson($route, [])->assertUnauthorized();
            $this->putJson($route.'/1', [])->assertUnauthorized();
            $this->patchJson($route.'/1', [])->assertUnauthorized();
            $this->deleteJson($route.'/1')->assertUnauthorized();
        }
    }

    public function test_login_and_logout_and_seed_are_functional(): void
    {
        $this->seed();
        $this->seed();
        $this->assertDatabaseCount('users', 1);
        $this->getJson('/auth/csrf')->assertOk()->assertJsonStructure(['csrf_token']);
        $this->postJson('/auth/login', ['email' => 'admin@test.com', 'password' => 'incorrecta'])->assertUnprocessable();
        $this->postJson('/auth/login', ['email' => 'admin@test.com', 'password' => 'admin123'])->assertOk()->assertJsonPath('user.email', 'admin@test.com')->assertJsonMissingPath('user.password');
        $this->assertAuthenticated();
        $this->getJson('/auth/me')->assertOk();
        $this->postJson('/auth/logout')->assertOk();
        $this->assertGuest();
        $this->getJson('/students')->assertUnauthorized();
    }

    public function test_student_crud_search_pagination_and_duplicate_validation(): void
    {
        $this->actingAs($this->teacher());
        $this->postJson('/students', [])->assertUnprocessable()->assertJsonValidationErrors(['name', 'registration_number']);
        $created = $this->postJson('/students', ['name' => 'Ana de prueba', 'registration_number' => 'ABC-01'])->assertCreated()->json('data');
        $this->postJson('/students', ['name' => 'Otra persona', 'registration_number' => 'ABC-01'])->assertUnprocessable();
        $this->putJson('/students/'.$created['id'], ['name' => 'Ana editada', 'registration_number' => 'ABC-01'])->assertOk();
        $this->getJson('/students/'.$created['id'])->assertJsonPath('data.name', 'Ana editada');
        for ($index = 0; $index < 11; $index++) {
            $this->student('TEST-'.$index);
        }
        $this->getJson('/students')->assertJsonCount(10, 'data')->assertJsonPath('total', 12);
        $this->getJson('/students?page=2')->assertJsonCount(2, 'data');
        $this->getJson('/students?q=ABC-01')->assertJsonCount(1, 'data');
        $this->deleteJson('/students/'.$created['id'])->assertNoContent();
        $this->getJson('/students/'.$created['id'])->assertNotFound();
    }

    public function test_grades_validate_bounds_student_and_duplicate_and_allow_zero(): void
    {
        $this->actingAs($this->teacher());
        $student = $this->student();
        $data = ['student_id' => $student->id, 'subject' => 'Matemática', 'period' => 'Unidad 1', 'score' => 0];
        foreach ([-1, 100.01, 101, 'abc', 50.123, null] as $score) {
            $this->postJson('/grades', array_merge($data, ['score' => $score]))->assertUnprocessable()->assertJsonValidationErrors('score');
        }
        $this->postJson('/grades', array_merge($data, ['student_id' => 9999]))->assertUnprocessable();
        $id = $this->postJson('/grades', $data)->assertCreated()->assertJsonPath('data.score', '0.00')->json('data.id');
        $this->postJson('/grades', $data)->assertUnprocessable()->assertJsonValidationErrors('period');
        $this->putJson('/grades/'.$id, array_merge($data, ['score' => 100]))->assertOk()->assertJsonPath('data.score', '100.00');
        $this->patchJson('/grades/'.$id, ['score' => 92.35])->assertOk()->assertJsonPath('data.score', '92.35');
        $this->putJson('/grades/'.$id, ['score' => 50])->assertUnprocessable();
        $this->getJson('/grades/'.$id)->assertOk()->assertJsonPath('data.student.id', $student->id);
    }

    public function test_related_student_cannot_be_deleted_until_grades_are_removed(): void
    {
        $this->actingAs($this->teacher());
        $student = $this->student();
        $grade = $this->grade($student);
        $this->deleteJson('/students/'.$student->id)->assertConflict();
        $this->assertDatabaseHas('grades', ['id' => $grade->id]);
        $this->deleteJson('/grades/'.$grade->id)->assertNoContent();
        $this->getJson('/grades/'.$grade->id)->assertNotFound();
        $this->deleteJson('/students/'.$student->id)->assertNoContent();
    }

    public function test_partial_update_cannot_create_a_duplicate_grade(): void
    {
        $this->actingAs($this->teacher());
        $first = $this->student();
        $second = $this->student('2026-002');
        $this->grade($first);
        $grade = $this->grade($second);
        $this->patchJson('/grades/'.$grade->id, ['student_id' => $first->id])->assertUnprocessable();
        $this->assertDatabaseHas('grades', ['id' => $grade->id, 'student_id' => $second->id]);
    }

    public function test_export_matches_filters_across_pages_and_keeps_text_as_text(): void
    {
        $this->actingAs($this->teacher());
        for ($index = 1; $index <= 12; $index++) {
            $student = $this->student('000'.$index);
            $student->update(['name' => '=1+1']);
            $this->grade($student, ['score' => 0]);
        }
        $this->grade($this->student('EXCLUDED'), ['subject' => 'Idioma']);
        $this->getJson('/grades?subject=Matemática&period=Unidad%201&q=000')->assertJsonCount(10, 'data')->assertJsonPath('total', 12);
        $response = $this->get('/grades/export/excel?subject=Matemática&period=Unidad%201&q=000&page=2')->assertOk();
        $response->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $file = tempnam(sys_get_temp_dir(), 'grades-');
        try {
            file_put_contents($file, $response->streamedContent());
            $book = IOFactory::load($file);
            $sheet = $book->getActiveSheet();
            $this->assertSame(13, $sheet->getHighestRow());
            $this->assertSame('Calificación', $sheet->getCell('F1')->getValue());
            $this->assertSame('=1+1', $sheet->getCell('B2')->getValue());
            $this->assertSame('s', $sheet->getCell('B2')->getDataType());
            $this->assertSame('00012', $sheet->getCell('C2')->getValue());
            $this->assertEquals(0, $sheet->getCell('F2')->getValue());
            $this->assertSame('n', $sheet->getCell('F2')->getDataType());
            $this->assertSame('n', $sheet->getCell('G2')->getDataType());
            $book->disconnectWorksheets();
        } finally {
            unlink($file);
        }
    }

    public function test_empty_export_is_a_valid_workbook_and_invalid_filters_are_rejected(): void
    {
        $this->actingAs($this->teacher());
        $this->getJson('/grades?page=0')->assertUnprocessable();
        $this->getJson('/grades/export/excel?subject[]=invalid')->assertUnprocessable();
        $response = $this->get('/grades/export/excel')->assertOk();
        $this->assertStringStartsWith('PK', $response->streamedContent());
    }
}
