<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->string('search_text')->default('');
        });
        DB::table('students')->orderBy('id')->chunkById(500, function ($students): void {
            foreach ($students as $student) {
                DB::table('students')->where('id', $student->id)->update([
                    'search_text' => Str::lower(Str::ascii($student->name.' '.$student->registration_number)),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->dropColumn('search_text');
        });
    }
};
