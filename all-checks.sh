#!/bin/sh
set -e

echo "========== check.sh =========="
sh check.sh

echo "========== health.sh =========="
sh health.sh

echo "========== All checks passed =========="
