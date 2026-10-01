<?php

declare(strict_types=1);

// Puertos driven no persistentes. Un archivo por interfaz en el proyecto real.

namespace Invoicing\Application\Port;

use DateTimeImmutable;
use Shared\Domain\DomainEvent;

/** Reloj inyectable: el dominio y la aplicación nunca llaman a now()/Carbon::now(). */
interface Clock
{
    public function now(): DateTimeImmutable;
}

/** Publicación de eventos de dominio. Implementación Laravel: Event::dispatch tras commit. */
interface EventBus
{
    public function publish(DomainEvent ...$events): void;
}

// --- Implementaciones de referencia (irían en Infrastructure) ------------------
//
// final class SystemClock implements Clock {
//     public function now(): DateTimeImmutable { return new DateTimeImmutable('now', new DateTimeZone('UTC')); }
// }
//
// final class LaravelEventBus implements EventBus {
//     public function publish(DomainEvent ...$events): void {
//         DB::afterCommit(function () use ($events): void {
//             foreach ($events as $event) { Event::dispatch($event); }
//         });
//     }
// }
//
// --- Fakes para tests (tests/Support) -----------------------------------------
//
// final class FixedClock implements Clock {
//     public function __construct(private readonly DateTimeImmutable $at) {}
//     public function now(): DateTimeImmutable { return $this->at; }
// }
//
// final class RecordingEventBus implements EventBus {
//     /** @var DomainEvent[] */ public array $published = [];
//     public function publish(DomainEvent ...$events): void { array_push($this->published, ...$events); }
//     /** @return DomainEvent[] */
//     public function ofType(string $class): array { return array_values(array_filter($this->published, fn ($e) => $e instanceof $class)); }
// }
