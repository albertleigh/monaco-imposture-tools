cmake_minimum_required(VERSION 3.16)
project(OnigurumaAsm)

set(CMAKE_CXX_STANDARD 20)

set(ONIGURUMA_DIRS ${CMAKE_SOURCE_DIR}/opt/oniguruma/src)
set(ONIGURUMA_LIBS ${CMAKE_SOURCE_DIR}/oniguruma/cmake-build-release/libonig.a)

add_executable(${PROJECT_NAME} src/main.cc)

include_directories(${CMAKE_BINARY_DIR} ${SOURCE_INCLUDE_DIRS} ${ONIGURUMA_DIRS})
target_link_libraries(${PROJECT_NAME} onig)

set(CMAKE_EXECUTABLE_SUFFIX ".js")

set_target_properties(
    ${PROJECT_NAME} PROPERTIES LINK_FLAGS "--bind -s NO_EXIT_RUNTIME=1 -s NO_FILESYSTEM=1 -s TOTAL_MEMORY=157286400 -s ALLOW_MEMORY_GROWTH=1 -s DEMANGLE_SUPPORT=1 -s EXPORTED_RUNTIME_METHODS=\"['ccall']\" -s MODULARIZE=1 -s EXPORT_NAME=\"'OnigurumaAsm'\""
)


install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})