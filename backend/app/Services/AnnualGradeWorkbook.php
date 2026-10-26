<?php

namespace App\Services;

use App\Queries\AnnualGradeQuery;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class AnnualGradeWorkbook
{
    public function __construct(private AnnualGradeQuery $summary) {}

    public function write(Builder $query): void
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Resumen anual');
        $sheet->fromArray(['ID alumno', 'Alumno', 'Matrícula', 'Asignatura', 'Ciclo', 'Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4', 'Promedio', 'Resultado', 'Sección']);
        $rowNumber = 2;
        foreach ($query->lazy(500) as $row) {
            $result = $this->summary->result($row);
            $sheet->setCellValue('A'.$rowNumber, $row->student_id);
            foreach (['B' => $row->student->name, 'C' => $row->student->registration_number, 'D' => $row->subject, 'K' => $result['status']] as $column => $text) {
                $sheet->setCellValueExplicit($column.$rowNumber, $text, DataType::TYPE_STRING);
            }
            $sheet->setCellValue('E'.$rowNumber, $row->academic_year);
            foreach ($result['terms'] as $index => $score) {
                $sheet->setCellValue([6 + $index, $rowNumber], $score);
            }
            $sheet->setCellValue('J'.$rowNumber, $result['average']);
            $sheet->setCellValue('L'.$rowNumber, $row->student->section);
            $rowNumber++;
        }
        $sheet->getStyle('A1:L1')->getFont()->setBold(true);
        $sheet->getStyle('F2:J'.max(2, $rowNumber - 1))->getNumberFormat()->setFormatCode('0.00##');
        $sheet->freezePane('F2');
        $sheet->setAutoFilter('A1:L'.max(1, $rowNumber - 1));
        foreach (['A' => 12, 'B' => 32, 'C' => 22, 'D' => 28, 'E' => 12, 'F' => 14, 'G' => 14, 'H' => 14, 'I' => 14, 'J' => 16, 'K' => 18, 'L' => 12] as $column => $width) {
            $sheet->getColumnDimension($column)->setWidth($width);
        }
        (new Xlsx($book))->save('php://output');
        $book->disconnectWorksheets();
    }
}
