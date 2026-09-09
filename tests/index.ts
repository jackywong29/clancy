// Entry point: `npm test` compiles tests/ with the project's own tsc, then
// runs this. Add a new suite by importing it here.

import { run } from './harness'

import './dates.test'
import './checklist.test'
import './audience.test'
import './intake.test'
import './proxy.test'

void run()
