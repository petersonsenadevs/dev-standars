<?php

declare(strict_types=1);

namespace Invoicing\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Invoicing\Application\Port\Clock;
use Invoicing\Application\Port\EventBus;
use Invoicing\Application\Query\PendingInvoicesReader;
use Invoicing\Domain\Event\InvoiceIssued;
use Invoicing\Domain\Repository\InvoiceRepository;
use Invoicing\Domain\Repository\InvoiceSequenceRepository;
use Invoicing\Infrastructure\Bus\LaravelEventBus;
use Invoicing\Infrastructure\Listeners\SendInvoiceEmail;
use Invoicing\Infrastructure\Persistence\Eloquent\EloquentInvoiceRepository;
use Invoicing\Infrastructure\Persistence\Eloquent\EloquentInvoiceSequenceRepository;
use Invoicing\Infrastructure\Persistence\Query\DbPendingInvoicesReader;
use Shared\Infrastructure\SystemClock;

/**
 * Un ServiceProvider por módulo/contexto. Es el único sitio donde se decide
 * qué implementación concreta satisface cada puerto.
 *
 * Registrar en bootstrap/providers.php (Laravel 11+) o config/app.php.
 * Los handlers (IssueInvoiceHandler, etc.) no necesitan binding: se autoresuelven.
 */
final class InvoicingServiceProvider extends ServiceProvider
{
    /** Bindings simples puerto => adaptador. Singletons cuando no tienen estado por request. */
    public array $singletons = [
        InvoiceRepository::class => EloquentInvoiceRepository::class,
        InvoiceSequenceRepository::class => EloquentInvoiceSequenceRepository::class,
        PendingInvoicesReader::class => DbPendingInvoicesReader::class,
        EventBus::class => LaravelEventBus::class,
        Clock::class => SystemClock::class,
    ];

    public function boot(): void
    {
        // Rutas y migraciones del módulo viven con el módulo.
        $this->loadRoutesFrom(__DIR__ . '/../Http/routes.php');
        $this->loadMigrationsFrom(__DIR__ . '/../Persistence/Migrations');

        // Listeners = adaptadores: traducen el evento a un command/puerto. Con IO -> ShouldQueue.
        Event::listen(InvoiceIssued::class, SendInvoiceEmail::class);
    }
}
