import os
import jwt
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import User, Transaction
from .schemas import RegisterIn, LoginIn, TokenOut, UserOut, TransactionCreate, TransactionOut
from .security import hash_password, verify_password, create_access_token, get_token_subject

# MVP convenience. Alembic migrations will replace create_all in the next iteration.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="BudgetFlow API", version="0.1.0")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)


@app.get("/health")
def health():
    return {"status": "ok"}


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    try:
        user_id = get_token_subject(credentials.credentials)
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Недействительный токен")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


@app.post("/auth/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    user = User(
        username=data.username,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Имя пользователя или email уже заняты")
    return user


@app.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return {"access_token": create_access_token(user.id)}


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.post("/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(
    data: TransactionCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    transaction = Transaction(
        user_id=user.id,
        amount=data.amount,
        description=data.description.strip(),
        category=data.category.strip(),
        type=data.type,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@app.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
    ).all()


@app.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    db.delete(transaction)
    db.commit()


@app.get("/summary")
def summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(
        select(
            func.coalesce(func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)), 0),
            func.coalesce(func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)), 0),
        ).where(Transaction.user_id == user.id)
    ).one()
    income, expenses = row
    return {
        "income": income,
        "expenses": expenses,
        "balance": income - expenses,
    }
