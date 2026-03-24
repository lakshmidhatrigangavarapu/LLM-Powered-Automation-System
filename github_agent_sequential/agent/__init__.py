"""
GitHub Agent Package
Provides GitHub automation capabilities through Google ADK
"""

from .agent import (
    github_agent,
    confirmed_actions,
    create_stable_action_key,
    SENSITIVE_ACTIONS,
    GITHUB_AGENT_INSTRUCTION
)

__all__ = [
    'github_agent',
    'confirmed_actions',
    'create_stable_action_key',
    'SENSITIVE_ACTIONS',
    'GITHUB_AGENT_INSTRUCTION'
]

__version__ = '0.2.0'
__author__ = 'Gangavarapu Lakshmi Dhatri'