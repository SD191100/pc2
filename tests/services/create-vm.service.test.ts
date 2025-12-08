import { jest } from "@jest/globals";

// Define mock factories
const mockFindVmByVmId = jest.fn() as jest.Mock<any>;
const mockCreateVmRecord = jest.fn() as jest.Mock<any>;
const mockUpdateVmRecord = jest.fn() as jest.Mock<any>;
const mockUpdateTask = jest.fn() as jest.Mock<any>;
const mockInvokeTask = jest.fn() as jest.Mock<any>;
const mockLogger = {
  info: jest.fn() as jest.Mock<any>,
  debug: jest.fn() as jest.Mock<any>,
  error: jest.fn() as jest.Mock<any>,
  warn: jest.fn() as jest.Mock<any>,
};

// Use unstable_mockModule for ESM
jest.unstable_mockModule("../../src/repositories/vm.repository.js", () => ({
  FindVmByVmId: mockFindVmByVmId,
  CreateVmRecord: mockCreateVmRecord,
  UpdateVmRecord: mockUpdateVmRecord,
  DeleteVmRecord: jest.fn(),
  FindAllVms: jest.fn(),
}));

jest.unstable_mockModule("../../src/repositories/task.repository.js", () => ({
  updateTask: mockUpdateTask,
}));

jest.unstable_mockModule("../../src/services/tasks.service.js", () => ({
  invokeTask: mockInvokeTask,
}));

jest.unstable_mockModule("../../src/utils/logger.utils.js", () => ({
  default: mockLogger,
}));

jest.unstable_mockModule("@pulumi/pulumi/automation/localWorkspace.js", () => ({
  LocalWorkspace: {
    createOrSelectStack: (jest.fn() as jest.Mock<any>).mockResolvedValue({
      name: "test-stack",
      setConfig: jest.fn(),
      up: (jest.fn() as jest.Mock<any>).mockResolvedValue({}),
      workspace: { removeStack: jest.fn() },
    }),
    selectStack: jest.fn() as jest.Mock<any>,
  },
}));

// Mock config/index.js if needed (for node name etc), or assume it works
jest.unstable_mockModule("../../src/config/index.js", () => ({
  config: {
    proxmox: {
      node: "pve",
      endpoint: "https://pve:8006",
      apiTokenId: "token",
      apiTokenSecret: "secret",
      sslVerify: false,
    },
    pulumi: {
      workDir: "/tmp",
      backendUrl: "file:///tmp",
    },
  },
}));

jest.unstable_mockModule("../../src/pulumi/pulumi.js", () => ({
  PulumiProxmoxProgram: jest.fn(),
}));

// Dynamic import of the service under test
const { CreateVmService } = await import("../../src/services/compute.service.js");

describe("CreateVmService", () => {
  const baseVm: any = {
    id: "1000",
    name: "test-vm",
    cpu: 1,
    memory: 1024,
    storage: 10,
    templateId: "9002",
    ioAddress: "10.0.0.51/24",
    gateway: "10.0.0.1",
    username: "admin",
    password: "admin",
    sshKey: "ssh-ed25519 AAA...",
  };

  const taskId = "task-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw 409 if VM with same id already exists", async () => {
    mockFindVmByVmId.mockResolvedValue({ vmId: "1000" });

    await expect(CreateVmService(baseVm, taskId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("should start task and return success when VM does not exist (repo throws 404)", async () => {
    // Mock repo throwing 404
    mockFindVmByVmId.mockRejectedValue({ statusCode: 404 });

    await CreateVmService(baseVm, taskId);

    expect(mockInvokeTask).toHaveBeenCalledWith(taskId);
    // Ensure we logged the start
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Task created successfully"),
      expect.anything()
    );
  });
});
