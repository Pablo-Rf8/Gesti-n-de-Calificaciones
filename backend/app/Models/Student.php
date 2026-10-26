<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Student extends Model
{
    protected $fillable = ['name', 'registration_number', 'section'];

    protected $attributes = ['section' => 'A'];

    protected $hidden = ['search_text'];

    protected static function booted(): void
    {
        static::saving(function (Student $student): void {
            $student->search_text = Str::lower(Str::ascii($student->name.' '.$student->registration_number));
        });
    }

    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where('search_text', 'like', '%'.Str::lower(Str::ascii(trim($term))).'%');
    }

    protected function casts(): array
    {
        return ['is_demo' => 'boolean'];
    }

    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }
}
