# Plastic Compute Cloud (pc2)

Plastic Compute Cloud (pc2) is a small service that manages virtual machines on a hypervisor.
Right now it targets **Proxmox VE**, but the design is meant to be adaptable to other hypervisors later.

This repo contains:

- An **Express** API for creating, updating, listing and controlling VMs
- **Pulumi** automation to provision VMs on Proxmox
- Background task tracking via a database
- Basic tests using **Jest** and **Supertest**

---

## What this service does

At a high level:

- **Create VM**
  - Clones from a Proxmox VM template
  - Applies cloud-init config (IP, user, SSH key, etc.)
  - Tracks the VM creation task in a DB
- **Update VM**
  - Can change CPU, memory
  - Can increase disk size using the Proxmox API
  - Uses Pulumi for infra updates and Proxmox API for storage resize
- **Delete VM**
  - Destroys the Pulumi stack
  - Cleans up the VM record
- **Power operations**
  - Start / stop / restart VM with Proxmox API
- **State**
  - List all VMs known to the system
  - Get the state of a specific VM

All of this is exposed through REST endpoints under `/compute` and related routes.

---

## Tech stack

- **Language**: TypeScript (Node.js)
- **Web framework**: Express
- **Infra as Code**: Pulumi
- **Hypervisor**: Proxmox VE
- **HTTP client**: `fetch` + `undici` Agent for Proxmox API calls
- **Database access**: Prisma (generated client)
- **Logging**: Custom logger (`src/utils/logger.utils.ts`)
- **Testing**: Jest + ts-jest, Supertest

---

## Project layout (short version)

- `src/app.ts` – Express app (routes, middleware)
- `src/routes/` – Route definitions (e.g. `compute.routes.ts`)
- `src/controllers/` – HTTP controllers (e.g. `compute.controller.ts`)
- `src/services/` – Core business logic (VM create/update/destroy, power)
- `src/pulumi/` – Pulumi inline program for VM provisioning
- `src/utils/` – Utilities (Proxmox API wrapper, state fetcher, logging)
- `tests/` – Jest test suites (service tests, etc.)

---

## Running the service

Make sure you have Node.js and npm installed.

Install dependencies:

```bash
npm install
```

Build and run in dev mode:

```bash
npm run start:dev
```

This will compile TypeScript to `dist/` and start the server with `nodemon`.

You’ll need to provide the usual environment/config for:

- Proxmox endpoint and API token
- Pulumi backend / workdir
- Database connection

(See `src/config/index.ts` and `.env.example` if present.)

---

## Running tests

Tests are written with Jest and Supertest.

To run the test suite:

```bash
npm test
```

Under the hood this runs Jest in ESM mode:

```bash
NODE_OPTIONS=--experimental-vm-modules jest
```

You can add more tests under `tests/`, mirroring the structure of `src/`.

---

## What this is *not*

This project is **not** a full cloud platform. It’s a focused service that:

- Wraps Proxmox VM lifecycle in a clean API
- Uses Pulumi for repeatable infra changes
- Adds some safety/logging and task tracking around Proxmox operations

It’s meant as a foundation or building block, not a “one-click cloud” by itself.

---

## Contributing / extending

Some natural next steps:

- Add more hypervisor backends behind the same API
- Expand tests, especially around failure modes and edge cases
- Improve error mapping from Proxmox/Pulumi into clean API error codes

Feel free to fork, experiment, and adapt this to your own Proxmox setup.
