<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->boolean('is_demo')->default(false);
        });
        Schema::table('grades', function (Blueprint $table): void {
            $table->unsignedSmallInteger('academic_year')->default((int) date('Y'));
            $table->dropUnique(['student_id', 'subject', 'period']);
            $table->unique(['student_id', 'subject', 'academic_year', 'period'], 'grades_student_subject_year_period_unique');
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table): void {
            $table->dropUnique('grades_student_subject_year_period_unique');
            $table->unique(['student_id', 'subject', 'period']);
            $table->dropColumn('academic_year');
        });
        Schema::table('students', function (Blueprint $table): void {
            $table->dropColumn('is_demo');
        });
    }
};
