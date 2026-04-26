with open("ejemplo modulo 4/output/CTA AHORROS SLENDY MARZO real.xls", "rb") as f:
    data = f.read()

print("First 40 bytes:", data[:40])
print("Is SYLK:", data[:10].startswith(b"ID;"))

# Parse as SYLK
content = data.decode("latin-1")
grid = {}
cur_row, cur_col = 1, 1
colors = {}  # (row) -> fill color token
for raw_line in content.split("\n"):
    line = raw_line.strip()
    if line.startswith("C;"):
        parts = line[2:].split(";")
        for p in parts:
            if p.startswith("Y"): cur_row = int(p[1:])
            elif p.startswith("X"): cur_col = int(p[1:])
            elif p.startswith("K"):
                val = p[1:]
                q = chr(34)
                if val.startswith(q) and val.endswith(q):
                    val = val[1:-1]
                grid[(cur_row, cur_col)] = val
    elif line.startswith("F;"):
        parts = line[2:].split(";")
        for p in parts:
            if p.startswith("X"): cur_col = int(p[1:])

max_row = max(r for r,c in grid)
max_col = max(c for r,c in grid)
print(f"Max row: {max_row}, Max col: {max_col}")

# Find CREDITO sheet area — check what sheets are in the file
# Look for sheet names in P records
for line in content.split("\n")[:30]:
    print(repr(line.strip()))

print()
print("=== All rows ===")
for r in range(1, max_row+1):
    row_data = [grid.get((r,c),"") for c in range(1, max_col+1)]
    if any(v for v in row_data):
        print(f"Row {r:3d}: {row_data}")
