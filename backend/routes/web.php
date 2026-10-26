<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\StudentController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->file(base_path('../frontend/index.html')));
Route::get('/assets/app.css', fn () => response()->file(base_path('../frontend/resources/css/app.css'), ['Content-Type' => 'text/css']));
Route::get('/assets/app.js', fn () => response()->file(base_path('../frontend/resources/js/app.js'), ['Content-Type' => 'text/javascript']));
Route::get('/auth/csrf', [AuthController::class, 'csrf']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware('auth')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::apiResource('students', StudentController::class);
    Route::get('/grades/export/excel', [GradeController::class, 'export'])->middleware('throttle:10,1');
    Route::apiResource('grades', GradeController::class);
});
