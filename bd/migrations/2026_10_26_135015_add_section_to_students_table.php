<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->string('section', 1)->default('A');
        });
        DB::table('students')->where('is_demo', true)
            ->whereIn('registration_number', array_map(fn (int $number): string => 'DEMO-'.now()->year.'-'.str_pad((string) $number, 3, '0', STR_PAD_LEFT), range(6, 10)))
            ->update(['section' => 'B']);
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->dropColumn('section');
        });
    }
};
