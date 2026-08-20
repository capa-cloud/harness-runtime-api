# Core Package

The core package exposes the provider SPI and an in-memory reference runtime. The reference runtime
is suitable for development, tests, and one-process embedding. It is not a durable or multi-tenant
scheduler.

Provider code receives a bounded execution context with an abort signal, normalized event emitter,
and action-request primitive. The runtime remains authoritative for portable state and event order.
