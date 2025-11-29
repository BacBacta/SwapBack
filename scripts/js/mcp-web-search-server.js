#!/usr/bin/env node

/**
 * Serveur MCP pour la recherche web avec Tavily
 * Compatible avec le protocole Model Context Protocol
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fetch = require('node-fetch');

class WebSearchMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'web-search-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Liste des outils disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'tavily_search',
            description: 'Recherche sur le web en utilisant l\'API Tavily pour des résultats précis et à jour',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'La requête de recherche',
                },
                max_results: {
                  type: 'number',
                  description: 'Nombre maximum de résultats (défaut: 5)',
                  default: 5,
                },
                search_depth: {
                  type: 'string',
                  description: 'Profondeur de recherche (basic ou advanced)',
                  enum: ['basic', 'advanced'],
                  default: 'basic',
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    // Gestionnaire d'exécution des outils
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'tavily_search') {
        return await this.handleTavilySearch(args);
      }

      throw new Error(`Outil inconnu: ${name}`);
    });
  }

  async handleTavilySearch(args) {
    const { query, max_results = 5, search_depth = 'basic' } = args;
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      throw new Error('TAVILY_API_KEY non configurée');
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          max_results: max_results,
          search_depth: search_depth,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Clé API Tavily invalide ou expirée');
        }
        throw new Error(`Erreur API Tavily: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Formatage des résultats
      let formattedResults = `🔍 **Résultats de recherche pour: "${query}"**\n\n`;

      if (data.answer) {
        formattedResults += `📝 **Résumé:**\n${data.answer}\n\n`;
      }

      if (data.results && data.results.length > 0) {
        formattedResults += `📋 **Sources (${data.results.length} résultats):**\n\n`;
        
        data.results.forEach((result, index) => {
          formattedResults += `**${index + 1}. ${result.title}**\n`;
          formattedResults += `🔗 ${result.url}\n`;
          if (result.content) {
            // Limiter le contenu à 200 caractères
            const content = result.content.length > 200 
              ? result.content.substring(0, 200) + '...'
              : result.content;
            formattedResults += `📄 ${content}\n`;
          }
          formattedResults += `📅 Score: ${result.score || 'N/A'}\n\n`;
        });
      } else {
        formattedResults += '❌ Aucun résultat trouvé.\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Erreur lors de la recherche Tavily: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serveur MCP Web Search démarré');
  }
}

// Démarrage du serveur
if (require.main === module) {
  const server = new WebSearchMCPServer();
  server.run().catch(console.error);
}

module.exports = WebSearchMCPServer;