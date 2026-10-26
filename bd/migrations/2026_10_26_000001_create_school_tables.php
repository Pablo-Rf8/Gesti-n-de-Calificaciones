<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 150);
            $table->string('registration_number', 40)->unique();
            $table->timestamps();
        });
        Schema::create('grades', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('subject', 100);
            $table->string('period', 60);
            $table->decimal('score', 5, 2);
            $table->timestamps();
            $table->unique(['student_id', 'subject', 'period']);
            $table->index(['subject', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
        Schema::dropIfExists('students');
    }
};
