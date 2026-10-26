<?php

namespace Tests\Feature;

use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use Database\Seeders\SchoolDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class AnnualGradesTest extends TestCase
{
    use RefreshDatabase;

    private function record(array $scores, string $registration = 'PRUEBA-001', int $year = 2026, string $subject = 'Matemática'): Student
    {
        $student = Student::firstOrCreate(['registration_number' => $registration], ['name' => 'Alumno de prueba']);
        foreach ($scores as $index => $score) {
            if ($score !== null) {
                Grade::create(['student_id' => $student->id, 'subject' => $subject, 'academic_year' => $year, 'period' => 'Bimestre '.($index + 1), 'score' => $score]);
            }
        }

        return $student;
    }

    public function test_summary_requires_login_and_handles_empty_data(): void
    {
        $this->getJson('/grades/summary')->assertUnauthorized();
        $this->getJson('/grades/export/excel?view=annual')->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson('/grades/summary')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_four_terms_are_required_and_the_unrounded_average_decides_approval(): void
    {
        $this->actingAs(User::factory()->create());
        $cases = [
            [[60, 60, 60, 60], 60, 'Aprobado', 4],
            [[59.99, 60, 60, 60], 59.9975, 'Reprobado', 4],
            [[0, 80, 80, 80], 60, 'Aprobado', 4],
            [[0, 0, 0, 0], 0, 'Reprobado', 4],
            [[100, 100, 100, null], null, 'Pendiente', 3],
        ];
        foreach ($cases as $index => [$scores, $average, $status, $count]) {
            $student = $this->record($scores, 'CASO-'.$index);
            $response = $this->getJson('/grades/summary?student_id='.$student->id)->assertOk()->assertJsonPath('data.0.status', $status)->assertJsonPath('data.0.completed_terms', $count);
            $this->assertEquals($average, $response->json('data.0.average'));
            if ($count < 4) {
                $this->assertNull($response->json('data.0.average'));
                $response->assertJsonPath('data.0.terms.3', null);
            }
        }
    }

    public function test_summary_separates_years_and_subjects_and_recalculates_after_edits(): void
    {
        $this->actingAs(User::factory()->create());
        $student = $this->record([50, 50, 50, 50]);
        $this->record([90, 90, 90, 90], year: 2027);
        $this->record([80, 80, 80, 80], subject: 'Idioma');
        $this->getJson('/grades/summary')->assertJsonPath('total', 3);
        $path = '/grades/summary?q=PRUEBA-001&academic_year=2026&subject=Matemática';
        $this->getJson($path.'&period=Bimestre%201')->assertJsonCount(1, 'data')->assertJsonPath('data.0.average', 50);
        $grade = Grade::where('student_id', $student->id)->where('subject', 'Matemática')->where('academic_year', 2026)->first();
        $this->patchJson('/grades/'.$grade->id, ['score' => 90])->assertOk();
        $this->assertDatabaseHas('grades', ['id' => $grade->id, 'score' => 90]);
        $this->getJson($path)->assertJsonPath('data.0.average', 60)->assertJsonPath('data.0.status', 'Aprobado');
        $this->deleteJson('/grades/'.$grade->id)->assertNoContent();
        $this->getJson($path)->assertJsonPath('data.0.average', null)->assertJsonPath('data.0.status', 'Pendiente');
    }

    public function test_periods_and_years_are_validated_and_repeating_a_year_does_not_duplicate_a_grade(): void
    {
        $this->actingAs(User::factory()->create());
        $student = $this->record([60]);
        $data = ['student_id' => $student->id, 'subject' => 'Matemática', 'academic_year' => 2026, 'period' => 'Bimestre 1', 'score' => 60];
        $this->postJson('/grades', $data)->assertUnprocessable();
        $this->postJson('/grades', array_merge($data, ['academic_year' => 2027]))->assertCreated();
        foreach (['Unidad 1', 'Bimestre 5', '1', ''] as $period) {
            $this->postJson('/grades', array_merge($data, ['period' => $period]))->assertUnprocessable()->assertJsonValidationErrors('period');
        }
        $this->postJson('/grades', array_merge($data, ['period' => 'Bimestre 2', 'academic_year' => 1999]))->assertUnprocessable()->assertJsonValidationErrors('academic_year');
        $this->getJson('/grades?period=Bimestre%205')->assertUnprocessable();
        $this->getJson('/grades/summary?academic_year=ayer')->assertUnprocessable();
        $this->assertDatabaseCount('grades', 2);
    }

    public function test_annual_excel_exports_all_filtered_groups_and_keeps_pending_cells_blank(): void
    {
        $this->actingAs(User::factory()->create());
        for ($index = 0; $index < 12; $index++) {
            $student = $this->record([60, 60, 60, $index === 0 ? null : 60], 'EXCEL-'.$index);
            $student->update(['name' => '=1+1']);
        }
        $this->record([90, 90, 90, 90], 'OTRO', 2027);
        $this->getJson('/grades/summary?academic_year=2026')->assertJsonCount(10, 'data')->assertJsonPath('total', 12);
        $response = $this->get('/grades/export/excel?view=annual&academic_year=2026&page=2')->assertOk();
        $file = tempnam(sys_get_temp_dir(), 'annual-');
        try {
            file_put_contents($file, $response->streamedContent());
            $book = IOFactory::load($file);
            $sheet = $book->getActiveSheet();
            $this->assertSame(13, $sheet->getHighestRow());
            $this->assertSame('Promedio', $sheet->getCell('J1')->getValue());
            $this->assertSame('=1+1', $sheet->getCell('B2')->getValue());
            $this->assertSame('s', $sheet->getCell('B2')->getDataType());
            $this->assertNull($sheet->getCell('I2')->getValue());
            $this->assertNull($sheet->getCell('J2')->getValue());
            $this->assertSame('Pendiente', $sheet->getCell('K2')->getValue());
            $this->assertSame(60, $sheet->getCell('J3')->getValue());
            $this->assertSame('Aprobado', $sheet->getCell('K3')->getValue());
            $book->disconnectWorksheets();
        } finally {
            unlink($file);
        }
    }

    public function test_demo_seed_adds_ten_students_and_preserves_existing_scores_on_repeat(): void
    {
        $this->seed(SchoolDemoSeeder::class);
        $this->assertDatabaseCount('students', 10);
        $this->assertDatabaseCount('grades', 79);
        $grade = Grade::first();
        $grade->update(['score' => 41]);
        $this->seed(SchoolDemoSeeder::class);
        $this->assertDatabaseCount('students', 10);
        $this->assertDatabaseCount('grades', 79);
        $this->assertDatabaseHas('grades', ['id' => $grade->id, 'score' => 41]);
        $this->assertSame(10, Student::where('is_demo', true)->count());
        $this->assertSame(5, Student::where('section', 'A')->count());
        $this->assertSame(5, Student::where('section', 'B')->count());
    }
}
