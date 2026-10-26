<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class GradeWorkbook
{
    public function write(Builder $grades): void
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Calificaciones');
        $sheet->fromArray(['ID', 'Alumno', 'Matrícula', 'Asignatura', 'Bimestre', 'Calificación', 'Fecha de captura', 'Ciclo', 'Sección']);
        $row = 2;
        foreach ($grades->lazy(500) as $grade) {
            $sheet->setCellValue('A'.$row, $grade->id);
            foreach (['B' => $grade->student->name, 'C' => $grade->student->registration_number, 'D' => $grade->subject, 'E' => $grade->period] as $column => $text) {
                // Los textos del usuario nunca se interpretan como fórmulas de Excel.
                $sheet->setCellValueExplicit($column.$row, $text, DataType::TYPE_STRING);
            }
            $sheet->setCellValue('F'.$row, (float) $grade->score);
            $sheet->setCellValue('G'.$row, Date::PHPToExcel($grade->created_at->timezone(config('app.timezone'))));
            $sheet->setCellValue('H'.$row, $grade->academic_year);
            $sheet->setCellValue('I'.$row, $grade->student->section);
            $row++;
        }
        $lastRow = max(2, $row - 1);
        $sheet->getStyle('A1:I1')->getFont()->setBold(true);
        $sheet->getStyle('F2:F'.$lastRow)->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle('G2:G'.$lastRow)->getNumberFormat()->setFormatCode('yyyy-mm-dd hh:mm');
        $sheet->freezePane('A2');
        $sheet->setAutoFilter('A1:I'.max(1, $row - 1));
        foreach (['A' => 10, 'B' => 32, 'C' => 18, 'D' => 28, 'E' => 22, 'F' => 16, 'G' => 23, 'H' => 12, 'I' => 12] as $column => $width) {
            $sheet->getColumnDimension($column)->setWidth($width);
        }
        (new Xlsx($book))->save('php://output');
        $book->disconnectWorksheets();
    }
}
