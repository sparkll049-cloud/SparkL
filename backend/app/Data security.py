def mask_name(full_name: str) -> str:
    parts = full_name.strip().split()
    return "".join(p[0].upper() for p in parts if p)


def mask_phone(phone: str) -> str:
    if len(phone) <= 4:
        return "*" * len(phone)
    return phone[:2] + "*" * (len(phone) - 4) + phone[-2:]


def mask_email(email: str) -> str:
    local, domain = email.split("@")
    visible = local[:4].capitalize()
    stars = "*" * max(len(local) - 4, 3)
    extension = "." + domain.split(".")[-1]
    return visible + stars + extension
