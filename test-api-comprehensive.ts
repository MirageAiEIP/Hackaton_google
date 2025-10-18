/**
 * Comprehensive API Routes Tester
 * Tests ALL routes from Swagger documentation
 */

import axios, { AxiosInstance } from 'axios';
import { faker } from '@faker-js/faker';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

class ComprehensiveAPITester {
  private client: AxiosInstance;
  private results: {
    passed: number;
    failed: number;
    skipped: number;
    tests: Array<{ name: string; status: 'PASS' | 'FAIL' | 'SKIP'; error?: string }>;
  };

  // Store IDs for dependent tests
  private operatorId: string | undefined;
  private sessionId: string | undefined;
  private callId: string | undefined;
  private queueEntryId: string | undefined;
  private handoffId: string | undefined;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    });

    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
    };
  }

  private log(message: string, color: keyof typeof colors = 'reset') {
    // eslint-disable-next-line no-console
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private async test(
    name: string,
    fn: () => Promise<void>,
    options: { skip?: boolean } = {}
  ): Promise<void> {
    if (options.skip) {
      this.log(`⏭️  SKIP: ${name}`, 'yellow');
      this.results.skipped++;
      this.results.tests.push({ name, status: 'SKIP' });
      return;
    }

    try {
      await fn();
      this.log(`✅ PASS: ${name}`, 'green');
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`❌ FAIL: ${name}`, 'red');
      this.log(`   Error: ${errorMsg}`, 'red');

      // Log more details about axios errors
      if (axios.isAxiosError(error) && error.response) {
        this.log(`   Status: ${error.response.status}`, 'red');
        this.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`, 'red');
      }

      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: errorMsg });
    }
  }

  private assertTrue(condition: boolean, message?: string, actualValue?: unknown) {
    if (!condition) {
      const msg = message || 'Assertion failed';
      const extra = actualValue ? ` (actual value: ${JSON.stringify(actualValue)})` : '';
      throw new Error(msg + extra);
    }
  }

  /**
   * 1. Health Routes
   */
  async testHealthRoutes() {
    this.log('\n📊 Testing Health Routes...', 'cyan');

    await this.test('GET /health - should return healthy status', async () => {
      const res = await this.client.get('/health');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.status === 'healthy', 'Expected status=healthy', res.data);
    });

    await this.test('GET /health/live - should return liveness status', async () => {
      const res = await this.client.get('/health/live');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.alive === true, 'Expected alive=true', res.data);
    });

    await this.test('GET /health/ready - should return readiness status', async () => {
      const res = await this.client.get('/health/ready');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.ready === true, 'Expected ready=true', res.data);
    });
  }

  /**
   * 2. Calls/Conversation Routes
   */
  async testCallsRoutes() {
    this.log('\n📞 Testing Calls/Conversation Routes...', 'cyan');

    await this.test('POST /api/v1/calls/start-web - should start web conversation', async () => {
      const res = await this.client.post('/api/v1/calls/start-web', {
        phoneNumber: '+33612345678',
        metadata: { source: 'test' },
      });

      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(res.data.sessionId !== undefined, 'Expected sessionId', res.data);
      this.assertTrue(res.data.agentConfig?.signedUrl !== undefined, 'Expected signedUrl', res.data);

      // Store for next tests
      this.sessionId = res.data.sessionId;
      this.callId = res.data.callId;
    });

    await this.test(
      'GET /api/v1/calls/:sessionId/status - should get conversation status',
      async () => {
        if (!this.sessionId) {
          throw new Error('No sessionId from previous test');
        }

        const res = await this.client.get(`/api/v1/calls/${this.sessionId}/status`);
        this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
        this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
        this.assertTrue(res.data.status === 'active', 'Expected status=active', res.data);
      },
      { skip: !this.sessionId }
    );

    await this.test(
      'POST /api/v1/calls/:sessionId/stop - should stop conversation',
      async () => {
        if (!this.sessionId) {
          throw new Error('No sessionId from previous test');
        }

        const res = await this.client.post(`/api/v1/calls/${this.sessionId}/stop`);
        this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
        this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      },
      { skip: !this.sessionId }
    );
  }

  /**
   * 3. Operators Routes
   */
  async testOperatorsRoutes() {
    this.log('\n👨‍⚕️ Testing Operators Routes...', 'cyan');

    await this.test('POST /api/v1/operators - should create operator', async () => {
      const res = await this.client.post('/api/v1/operators', {
        name: faker.person.fullName(),
        email: faker.internet.email(),
      });

      this.assertTrue(
        res.status === 200 || res.status === 201,
        `Expected 200 or 201, got ${res.status}`
      );
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(
        res.data.data?.operator?.id !== undefined,
        'Expected operator.id',
        res.data
      );

      this.operatorId = res.data.data.operator.id;
    });

    await this.test('GET /api/v1/operators - should list all operators', async () => {
      const res = await this.client.get('/api/v1/operators');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(
        Array.isArray(res.data.data?.operators),
        'Expected operators array',
        res.data
      );
    });

    await this.test(
      'PATCH /api/v1/operators/:operatorId/status - should update operator status',
      async () => {
        if (!this.operatorId) {
          throw new Error('No operatorId from previous test');
        }

        const res = await this.client.patch(`/api/v1/operators/${this.operatorId}/status`, {
          status: 'AVAILABLE',
        });

        this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
        this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      },
      { skip: !this.operatorId }
    );

    await this.test('GET /api/v1/operators/available - should list available operators', async () => {
      const res = await this.client.get('/api/v1/operators/available');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(
        Array.isArray(res.data.data?.operators),
        'Expected operators array',
        res.data
      );
    });
  }

  /**
   * 4. Tools Routes (ElevenLabs Client Tools)
   */
  async testToolsRoutes() {
    this.log('\n🛠️  Testing ElevenLabs Tools Routes...', 'cyan');

    await this.test('GET /api/v1/tools/health - should return tools health', async () => {
      const res = await this.client.get('/api/v1/tools/health');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.tools), 'Expected tools array', res.data);
    });

    await this.test(
      'POST /api/v1/tools/get_patient_history - should get patient history',
      async () => {
        const res = await this.client.post('/api/v1/tools/get_patient_history', {
          phoneHash: 'test-hash-123',
        });

        this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
        this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      }
    );

    await this.test(
      'POST /api/v1/tools/get_pharmacy_on_duty - should find pharmacy',
      async () => {
        const res = await this.client.post('/api/v1/tools/get_pharmacy_on_duty', {
          latitude: 48.8566,
          longitude: 2.3522,
          city: 'Paris',
        });

        this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
        this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      }
    );
  }

  /**
   * 5. Handoff Routes
   */
  async testHandoffRoutes() {
    this.log('\n🤝 Testing Handoff Routes...', 'cyan');

    await this.test('GET /api/v1/handoff/pending - should list pending handoffs', async () => {
      const res = await this.client.get('/api/v1/handoff/pending');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.data), 'Expected data array', res.data);
    });
  }

  /**
   * 6. Test Routes (Development)
   */
  async testDevelopmentRoutes() {
    this.log('\n🧪 Testing Development Routes...', 'cyan');

    await this.test('GET /api/v1/test/health - should return test health', async () => {
      const res = await this.client.get('/api/v1/test/health');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.status === 'ok', 'Expected status=ok', res.data);
    });

    await this.test('POST /api/v1/test/dispatch-smur - should dispatch SMUR', async () => {
      const res = await this.client.post('/api/v1/test/dispatch-smur', {
        priority: 'P1',
        location: '123 Rue de Test, Paris',
        reason: 'Test emergency dispatch',
        patientPhone: '+33612345678',
      });

      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(res.data.dispatchId !== undefined, 'Expected dispatchId', res.data);
    });

    await this.test('GET /api/v1/test/conversations - should list conversations', async () => {
      const res = await this.client.get('/api/v1/test/conversations');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
    });

    await this.test('GET /api/v1/test/queue - should list queue entries', async () => {
      const res = await this.client.get('/api/v1/test/queue');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.queue), 'Expected queue array', res.data);
    });

    await this.test('GET /api/v1/test/calls/active - should list active calls', async () => {
      const res = await this.client.get('/api/v1/test/calls/active');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.calls), 'Expected calls array', res.data);
    });

    await this.test('GET /api/v1/test/interventions/map - should get map data', async () => {
      const res = await this.client.get('/api/v1/test/interventions/map');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.dispatches), 'Expected dispatches array', res.data);
    });

    await this.test('GET /api/v1/test/dispatches - should list all dispatches', async () => {
      const res = await this.client.get('/api/v1/test/dispatches');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.success === true, 'Expected success=true', res.data);
      this.assertTrue(Array.isArray(res.data.dispatches), 'Expected dispatches array', res.data);
    });
  }

  /**
   * 7. Dashboard Routes
   */
  async testDashboardRoutes() {
    this.log('\n📈 Testing Dashboard Routes...', 'cyan');

    await this.test('GET /api/v1/dashboard/stats - should return dashboard stats', async () => {
      const res = await this.client.get('/api/v1/dashboard/stats');
      this.assertTrue(res.status === 200, `Expected 200, got ${res.status}`);
      this.assertTrue(res.data.connectedClients !== undefined, 'Expected stats', res.data);
    });
  }

  /**
   * Print test results summary
   */
  private printSummary() {
    const total = this.results.passed + this.results.failed + this.results.skipped;

    this.log('\n' + '='.repeat(80), 'blue');
    this.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY', 'blue');
    this.log('='.repeat(80), 'blue');

    this.log(`\n✅ Passed:  ${this.results.passed}/${total}`, 'green');
    this.log(`❌ Failed:  ${this.results.failed}/${total}`, this.results.failed > 0 ? 'red' : 'reset');
    this.log(`⏭️  Skipped: ${this.results.skipped}/${total}`, 'yellow');

    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;
    this.log(`\n📈 Success Rate: ${successRate}%`, successRate === '100.00' ? 'green' : 'yellow');

    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:', 'red');
      this.results.tests
        .filter((t) => t.status === 'FAIL')
        .forEach((t) => {
          this.log(`   - ${t.name}`, 'red');
          if (t.error) {
            this.log(`     ${t.error}`, 'red');
          }
        });
    }

    // Success summary by category
    const categories = {
      Health: this.results.tests.filter((t) => t.name.includes('health')),
      Calls: this.results.tests.filter((t) => t.name.includes('calls') || t.name.includes('conversation')),
      Operators: this.results.tests.filter((t) => t.name.includes('operators')),
      Tools: this.results.tests.filter((t) => t.name.includes('tools')),
      Handoff: this.results.tests.filter((t) => t.name.includes('handoff')),
      Development: this.results.tests.filter((t) => t.name.includes('test/')),
      Dashboard: this.results.tests.filter((t) => t.name.includes('dashboard')),
    };

    this.log('\n📋 Results by Category:', 'cyan');
    Object.entries(categories).forEach(([category, tests]) => {
      const passed = tests.filter((t) => t.status === 'PASS').length;
      const total = tests.length;
      const color = passed === total ? 'green' : passed > 0 ? 'yellow' : 'red';
      this.log(`   ${category}: ${passed}/${total}`, color);
    });

    this.log('\n' + '='.repeat(80), 'blue');
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    this.log('🚀 Starting Comprehensive API Route Tests...', 'blue');
    this.log(`📍 Base URL: ${BASE_URL}`, 'blue');
    this.log('='.repeat(80), 'blue');

    // Check if server is running
    try {
      await this.client.get('/health');
    } catch (error) {
      this.log('\n❌ ERROR: Cannot connect to server!', 'red');
      this.log(`Make sure the server is running on ${BASE_URL}`, 'red');
      process.exit(1);
    }

    // Run all test suites
    await this.testHealthRoutes();
    await this.testCallsRoutes();
    await this.testOperatorsRoutes();
    await this.testToolsRoutes();
    await this.testHandoffRoutes();
    await this.testDevelopmentRoutes();
    await this.testDashboardRoutes();

    // Print summary
    this.printSummary();

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new ComprehensiveAPITester();
tester.runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
