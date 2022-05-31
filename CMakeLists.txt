cmake_minimum_required(VERSION 3.16)
project(monaco-imposture-tools-root)

add_subdirectory(${CMAKE_SOURCE_DIR}/opt/oniguruma ${CMAKE_BINARY_DIR}/oniguruma)
add_subdirectory(${CMAKE_SOURCE_DIR}/packages/onigasm ${CMAKE_BINARY_DIR}/onigasm)
