/// <reference types="vitest" />
import { defineConfig } from 'vite'

const isCI = !!process.env.CI

const defaultExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
]

export default defineConfig({
  test: {
    // Ignore tests which rely on environment variables during CI
    // (these tests are still really useful to run locally)
    exclude: defaultExclude.concat(
      isCI
        ? [
            'src/answer-engine.test.ts',
            'src/moderations.test.ts',
            'src/entities.test.ts'
          ]
        : []
    )
  }
})
