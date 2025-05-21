#!/usr/bin/env node

import { FastMCP } from "fastmcp"
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'
import Handlebars from "handlebars"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROMPTS_DIR = path.join(__dirname, 'prompts')

async function registerPrompts(server: FastMCP) {
  try {
    await fs.ensureDir(PROMPTS_DIR)
    const files = await fs.readdir(PROMPTS_DIR)
    const filtered = files.filter((file: string) => file.endsWith(".yaml") || file.endsWith(".yml") || file.endsWith(".json"))
    for (const file of filtered) {
      const filePath = path.join(PROMPTS_DIR, file)
      const content = await fs.readFile(filePath, "utf8")
      const prompt = file.endsWith(".json") ? JSON.parse(content) : YAML.parse(content)
      if (!prompt.name) {
        console.warn(`Warning: Prompt in ${filePath} is missing a name field. Skipping.`)
        return null
      }

      // Add prompt to server
      server.addPrompt({
        ...prompt,
        load: async (args) => {
          const template = Handlebars.compile(prompt.template)
          return template(args);
        },
      })
    }
  } catch (error) {
    console.error("Error loading prompts:", error)
    return []
  }
}

(async () => {
  try {
    const server = new FastMCP({ name: "Prompt Master", version: "0.0.1" })
    await registerPrompts(server)
    server.start({ transportType: "stdio" })
  } catch (error) {
    console.error('Failed to start MCP server')
    process.exit(1)
  }
})()