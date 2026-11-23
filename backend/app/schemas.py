from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing_extensions import Annotated

Username = Annotated[str, StringConstraints(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class RegisterIn(BaseModel):
    username: Username
    email: EmailStr
    password: Password


class LoginIn(BaseModel):
    email: EmailStr
    password: Password


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    description: str = Field(min_length=1, max_length=200)
    category: str = Field(default="Другое", min_length=1, max_length=50)
    type: Literal["income", "expense"]


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Decimal
    description: str
    category: str
    type: Literal["income", "expense"]
    created_at: datetime
