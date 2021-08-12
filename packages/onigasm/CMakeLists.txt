cmake_minimum_required(VERSION 3.19)
project(OnigurumaAsm)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_EXECUTABLE_SUFFIX ".js")

set(ONIGURUMA_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/oniguruma/src)
set(ONIGURUMA_LIBS ${CMAKE_CURRENT_SOURCE_DIR}/oniguruma/cmake-build-release/libonig.a)


include_directories(${CMAKE_BINARY_DIR} ${SOURCE_INCLUDE_DIRS} ${ONIGURUMA_DIRS})
file(GLOB SOURCE_FILES "src/*.cc")
add_executable(${PROJECT_NAME} ${SOURCE_FILES})
#add_library(${PROJECT_NAME} ${SOURCE_FILES})
target_link_libraries(${PROJECT_NAME} ${ONIGURUMA_LIBS})

set_target_properties(
    ${PROJECT_NAME} PROPERTIES LINK_FLAGS "--bind -s NO_EXIT_RUNTIME=1 -s NO_FILESYSTEM=1 -s TOTAL_MEMORY=157286400 -s ALLOW_MEMORY_GROWTH=1 -s DEMANGLE_SUPPORT=1 -s EXPORTED_RUNTIME_METHODS=\"['ccall']\" -s MODULARIZE=1 -s EXPORT_NAME=\"'OnigurumaAsm'\""
)
