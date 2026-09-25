# Image originals backup

Created by scripts/optimize-images.py before compression.

## Revert all optimized images

From repo root (PowerShell):

```powershell
Copy-Item -Path "assets\images\_originals_backup\*" -Destination "assets\images\" -Recurse -Force
```

Or with Python:

```powershell
python -c "from pathlib import Path; import shutil; b=Path('assets/images/_originals_backup'); r=Path('assets/images');
[shutil.copy2(p, r/p.relative_to(b)) for p in b.rglob('*') if p.is_file()]"
```

Only files that were changed are in this folder (first backup kept).
