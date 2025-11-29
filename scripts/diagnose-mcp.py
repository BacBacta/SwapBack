#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import subprocess
import sys
import time
import requests
from pathlib import Path

def log_success(msg):
    print(f"✅ {msg}")

def log_error(msg):
    print(f"❌ {msg}")

def log_warning(msg):
    print(f"⚠️  {msg}")

def log_info(msg):
    print(f"ℹ️  {msg}")

def test_tavily_api(api_key):
    """Test l'API Tavily directement"""
    try:
        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": "test",
                "max_results": 1
            },
            timeout=10
        )
        
        if response.status_code == 200:
            log_success("API Tavily fonctionne (HTTP 200)")
            return True
        elif response.status_code == 401:
            log_error("Clé API Tavily invalide (HTTP 401)")
            return False
        else:
            log_warning(f"API Tavily répond avec code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        log_error(f"Erreur de connexion à l'API Tavily: {e}")
        return False

def check_mcp_config():
    """Vérifier la configuration MCP"""
    config_paths = [
        "/tmp/vscode-user/User/settings.json",
        os.path.expanduser("~/.vscode/User/settings.json"),
        "/workspaces/SwapBack/mcp.json"
    ]
    
    for config_path in config_paths:
        if os.path.exists(config_path):
            log_info(f"Configuration trouvée: {config_path}")
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    
                if 'cline.mcpServers' in config:
                    log_success("Configuration MCP détectée")
                    
                    if 'tavily' in config['cline.mcpServers']:
                        tavily_config = config['cline.mcpServers']['tavily']
                        
                        if 'env' in tavily_config and 'TAVILY_API_KEY' in tavily_config['env']:
                            api_key = tavily_config['env']['TAVILY_API_KEY']
                            log_success(f"Clé API Tavily trouvée: {api_key[:8]}...")
                            return api_key
                        else:
                            log_error("Clé API Tavily manquante dans la configuration")
                    else:
                        log_error("Configuration Tavily manquante")
                else:
                    log_error("Configuration cline.mcpServers manquante")
                    
            except json.JSONDecodeError:
                log_error(f"Erreur de syntaxe JSON dans: {config_path}")
            except Exception as e:
                log_error(f"Erreur lors de la lecture de {config_path}: {e}")
    
    return None

def check_node_environment():
    """Vérifier l'environnement Node.js"""
    try:
        node_version = subprocess.check_output(['node', '--version'], text=True).strip()
        log_success(f"Node.js: {node_version}")
        
        npm_version = subprocess.check_output(['npm', '--version'], text=True).strip()
        log_success(f"npm: {npm_version}")
        
        return True
    except subprocess.CalledProcessError:
        log_error("Node.js ou npm non installé")
        return False
    except FileNotFoundError:
        log_error("Node.js non trouvé dans le PATH")
        return False

def test_mcp_server():
    """Tester le serveur MCP Tavily"""
    try:
        result = subprocess.run(
            ['npx', '-y', '@modelcontextprotocol/server-tavily', '--help'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            log_success("Serveur MCP Tavily accessible")
            return True
        else:
            log_error(f"Erreur serveur MCP: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        log_error("Timeout lors du test du serveur MCP")
        return False
    except Exception as e:
        log_error(f"Erreur lors du test MCP: {e}")
        return False

def main():
    print("🔍 DIAGNOSTIC AVANCÉ MCP TAVILY")
    print("================================")
    
    # 1. Vérifier Node.js
    log_info("1. Vérification de l'environnement Node.js")
    if not check_node_environment():
        log_error("Environnement Node.js requis manquant")
        return 1
    
    # 2. Vérifier la configuration MCP
    log_info("2. Vérification de la configuration MCP")
    api_key = check_mcp_config()
    if not api_key:
        log_error("Configuration MCP invalide ou manquante")
        return 1
    
    # 3. Tester l'API Tavily
    log_info("3. Test de l'API Tavily")
    if not test_tavily_api(api_key):
        log_error("API Tavily non accessible")
        return 1
    
    # 4. Tester le serveur MCP
    log_info("4. Test du serveur MCP Tavily")
    if not test_mcp_server():
        log_error("Serveur MCP Tavily non fonctionnel")
        return 1
    
    # 5. Résumé
    print("\n✅ DIAGNOSTIC RÉUSSI!")
    print("MCP Tavily devrait fonctionner correctement.")
    print("\nÉtapes finales:")
    print("1. Sauvegardez mcp.json")
    print("2. Rechargez VS Code")
    print("3. Testez: 'Search Tavily: test'")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())