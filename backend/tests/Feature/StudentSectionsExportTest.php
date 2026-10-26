<?php

namespace Tests\Feature;

use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class StudentSectionsExportTest extends TestCase
{
    use RefreshDatabase;

    private function grade(Student $student): void
    {
        Grade::create(['student_id' => $student->id, 'subject' => 'Matemática', 'period' => 'Bimestre 1', 'academic_year' => 2026, 'score' => 85]);
    }

    public function test_search_matches_accents_case_and_registration_after_a_student_is_edited(): void
    {
        $this->actingAs(User::factory()->create());
        $student = Student::create(['name' => 'Sofía Pérez', 'registration_number' => 'BUS-01']);
        Student::create(['name' => 'Pedro López', 'registration_number' => 'BUS-02']);
        $this->grade($student);

        foreach (['SOFIA', 'sofía', 'bus-01'] as $term) {
            $this->getJson('/students?q='.urlencode($term))->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $student->id)->assertJsonMissingPath('data.0.search_text');
        }
        foreach (['/grades', '/grades/summary'] as $path) {
            $this->getJson($path.'?q=sofia')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.student_id', $student->id);
        }
        $this->putJson('/students/'.$student->id, ['name' => 'José Pérez', 'registration_number' => 'NUEVA-01'])->assertOk();
        $this->getJson('/students?q=sofia')->assertJsonPath('total', 0);
        $this->getJson('/students?q=BUS-01')->assertJsonPath('total', 0);
        $this->getJson('/students?q=JOSE')->assertJsonPath('data.0.id', $student->id);
        $this->getJson('/students?q=nueva-01')->assertJsonPath('data.0.id', $student->id);
    }

    public function test_section_filters_follow_student_changes_and_reject_unknown_sections(): void
    {
        $this->actingAs(User::factory()->create());
        $first = Student::create(['name' => 'Ana', 'registration_number' => 'A-1', 'section' => 'A']);
        $second = Student::create(['name' => 'Luis', 'registration_number' => 'B-1', 'section' => 'B']);
        $this->grade($first);
        $this->grade($second);

        foreach (['/students', '/grades', '/grades/summary'] as $path) {
            $this->getJson($path.'?section=A')->assertOk()->assertJsonPath('total', 1);
            $this->getJson($path.'?section=B')->assertOk()->assertJsonPath('total', 1);
            $this->getJson($path)->assertOk()->assertJsonPath('total', 2);
            $this->getJson($path.'?section=C')->assertUnprocessable()->assertJsonValidationErrors('section');
        }
        $data = ['name' => 'Ana', 'registration_number' => 'A-1', 'section' => 'B'];
        $this->putJson('/students/'.$first->id, $data)->assertOk()->assertJsonPath('data.section', 'B');
        $this->assertDatabaseHas('students', ['id' => $first->id, 'section' => 'B']);
        $this->getJson('/grades?section=A')->assertJsonPath('total', 0);
        $this->getJson('/grades/summary?section=B')->assertJsonPath('total', 2);
        $this->putJson('/students/'.$first->id, array_merge($data, ['section' => 'C']))->assertUnprocessable()->assertJsonValidationErrors('section');
        $this->putJson('/students/'.$first->id, ['name' => 'Ana', 'registration_number' => 'A-1'])->assertOk()->assertJsonPath('data.section', 'B');
        $this->postJson('/students', ['name' => 'Carlos', 'registration_number' => 'NEW', 'section' => 'B'])->assertCreated()->assertJsonPath('data.section', 'B');
        $this->postJson('/students', ['name' => 'Otra', 'registration_number' => 'INVALID', 'section' => 'C'])->assertUnprocessable();
        $this->assertDatabaseMissing('students', ['registration_number' => 'INVALID']);
    }

    public function test_exports_include_only_the_selected_sections_in_both_formats(): void
    {
        $this->actingAs(User::factory()->create());
        foreach (['A', 'B'] as $section) {
            $this->grade(Student::create(['name' => 'Alumno '.$section, 'registration_number' => $section, 'section' => $section]));
        }

        foreach (['grades' => 'I', 'annual' => 'L'] as $view => $column) {
            foreach (['A', 'B', ''] as $section) {
                $response = $this->get('/grades/export/excel?view='.$view.'&section='.$section)->assertOk();
                $response->assertDownload('Calificaciones generales'.($section ? ' - Seccion '.$section : '').'.xlsx');
                $file = tempnam(sys_get_temp_dir(), 'sections-');
                try {
                    file_put_contents($file, $response->streamedContent());
                    $book = IOFactory::load($file);
                    $sheet = $book->getActiveSheet();
                    $this->assertSame('Sección', $sheet->getCell($column.'1')->getValue());
                    $this->assertSame($section ? 2 : 3, $sheet->getHighestRow());
                    $sections = [];
                    for ($row = 2; $row <= $sheet->getHighestRow(); $row++) {
                        $sections[] = $sheet->getCell($column.$row)->getValue();
                    }
                    sort($sections);
                    $this->assertSame($section ? [$section] : ['A', 'B'], $sections);
                    $book->disconnectWorksheets();
                } finally {
                    unlink($file);
                }
            }
        }
    }

    public function test_download_names_use_a_unique_student_but_not_an_unfiltered_or_ambiguous_list(): void
    {
        $this->actingAs(User::factory()->create());
        $student = Student::create(['name' => 'Sofía Pérez', 'registration_number' => 'UNO']);
        $this->grade($student);
        $this->get('/grades/export/excel')->assertOk()->assertDownload('Calificaciones generales.xlsx');

        foreach (['grades', 'annual'] as $view) {
            $response = $this->get('/grades/export/excel?view='.$view.'&q=sofia')->assertOk()->assertDownload('Calificaciones de Sofia Perez.xlsx');
            $this->assertStringContainsString("filename*=utf-8''Calificaciones de Sofía Pérez.xlsx", rawurldecode($response->headers->get('Content-Disposition')));
        }
        Student::create(['name' => 'Sofía López', 'registration_number' => 'DOS']);
        $this->get('/grades/export/excel?q=sofia')->assertOk()->assertDownload('Calificaciones generales.xlsx');
        $this->get('/grades/export/excel?q=UNO')->assertOk()->assertDownload('Calificaciones de Sofia Perez.xlsx');
        $this->get('/grades/export/excel?student_id='.$student->id)->assertOk()->assertDownload('Calificaciones de Sofia Perez.xlsx');
        $this->get('/grades/export/excel?q=sin-coincidencias')->assertOk()->assertDownload('Calificaciones generales.xlsx');
    }

    public function test_download_names_remove_file_separators_and_control_characters(): void
    {
        $this->actingAs(User::factory()->create());
        $student = Student::create(['name' => "Ana / López\\Ruiz\r\n:*?", 'registration_number' => 'SAFE']);

        $this->get('/grades/export/excel?student_id='.$student->id)->assertOk()->assertDownload('Calificaciones de Ana Lopez Ruiz.xlsx');
    }
}
